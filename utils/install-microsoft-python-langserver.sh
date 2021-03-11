#!/usr/bin/env bash

SERVER_XML="$(curl -sSL "https://pvsc.blob.core.windows.net/python-language-server-stable?restype=container&comp=list&prefix=Python-Language-Server-linux-x64")"
NUPKG_LINK="$(echo "$SERVER_XML" | grep -Eo 'https://[^<]+\.nupkg' | tail -n1)"
wget -nv "${NUPKG_LINK}"
unzip -d /opt/mspyls Python-Language-Server-linux-x64.*.nupkg
chmod +x /opt/mspyls/Microsoft.Python.LanguageServer
ln -s /opt/mspyls/Microsoft.Python.LanguageServer /usr/local/bin/Microsoft.Python.LanguageServer
rm Python-Language-Server-linux-x64.*.nupkg
