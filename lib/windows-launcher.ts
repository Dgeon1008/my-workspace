import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { ProjectError } from './project.ts';
import type { DesktopConfig } from './desktop-store.ts';

export type ProcessIdentity = { pid: number | null; processKey: string | null };
export type DesktopAdapter = { start: (config: DesktopConfig) => Promise<ProcessIdentity>; inspect: (process: ProcessIdentity) => Promise<'alive' | 'gone' | 'unknown'> };

function powershell(script: string, extraEnv: Record<string, string>): Promise<unknown> {
  if (process.platform !== 'win32') return Promise.reject(new ProjectError('데스크톱 프로그램 실행은 Windows에서 지원합니다.'));
  const executable = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return new Promise((resolve, reject) => {
    execFile(executable, ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, ...extraEnv }, windowsHide: true, timeout: 15000, maxBuffer: 65536 }, (error, stdout) => {
      if (error) { reject(new ProjectError('Windows에서 실행 요청을 처리하지 못했습니다. 파일 권한과 프로그램 상태를 확인해주세요.', 502)); return; }
      try { resolve(JSON.parse(stdout.trim().replace(/^\uFEFF/, ''))); }
      catch { reject(new ProjectError('Windows 실행 결과를 확인하지 못했습니다. 프로그램 창을 확인해주세요.', 502)); }
    });
  });
}

export const windowsDesktopAdapter: DesktopAdapter = {
  async start(config) {
    // The helper stays hidden; the selected desktop program opens normally.
    // User paths are environment values, never interpolated PowerShell code.
    const result = await powershell(`$ErrorActionPreference='Stop';
      $launched = Start-Process -FilePath $env:MOA_DESKTOP_FILE -WorkingDirectory $env:MOA_DESKTOP_CWD -WindowStyle Normal -PassThru;
      $launchPid=$null; $launchKey=$null;
      try { $launchKey=$launched.StartTime.ToUniversalTime().Ticks.ToString(); $launchPid=$launched.Id } catch {}
      @{pid=$launchPid;processKey=$launchKey} | ConvertTo-Json -Compress`, { MOA_DESKTOP_FILE: config.target, MOA_DESKTOP_CWD: config.root }) as ProcessIdentity;
    if (result.pid !== null && (!Number.isSafeInteger(result.pid) || result.pid <= 0)) throw new ProjectError('실행된 프로세스를 확인하지 못했습니다.', 502);
    return { pid: result.pid, processKey: typeof result.processKey === 'string' ? result.processKey : null };
  },
  async inspect(identity) {
    if (!identity.pid || !identity.processKey) return 'unknown';
    try {
      const result = await powershell(`$ErrorActionPreference='Stop';
        try { $observed=Get-Process -Id ([int]$env:MOA_DESKTOP_PID) -ErrorAction Stop }
        catch { @{state='gone'} | ConvertTo-Json -Compress; exit }
        try {
          $matches=$observed.StartTime.ToUniversalTime().Ticks.ToString() -eq $env:MOA_DESKTOP_KEY;
          @{state=$(if($matches){'alive'}else{'gone'})} | ConvertTo-Json -Compress
        } catch { @{state='unknown'} | ConvertTo-Json -Compress }`, { MOA_DESKTOP_PID: String(identity.pid), MOA_DESKTOP_KEY: identity.processKey }) as { state: string };
      return result.state === 'alive' || result.state === 'gone' ? result.state : 'unknown';
    } catch { return 'unknown'; }
  },
};
