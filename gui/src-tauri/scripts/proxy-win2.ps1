param (
    [string]$Action,
    [string]$Proxy
)

function Set-Proxy {
    if (-not $Proxy) { exit 1 }
    try {
        $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
        Set-ItemProperty -Path $regPath -Name ProxyEnable -Value 1
        Set-ItemProperty -Path $regPath -Name ProxyServer -Value $Proxy
        exit 0
    } catch { exit 1 }
}

function Unset-Proxy {
    try {
        $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings"
        Set-ItemProperty -Path $regPath -Name ProxyEnable -Value 0
        Remove-ItemProperty -Path $regPath -Name ProxyServer -ErrorAction SilentlyContinue
        exit 0
    } catch { exit 1 }
}

switch ($Action) {
    "register" { Set-Proxy }
    "unregister" { Unset-Proxy }
    default { exit 1 }
}

