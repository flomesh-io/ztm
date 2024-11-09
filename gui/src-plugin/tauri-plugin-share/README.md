# Tauri Plugin share

## Share file
```
import { invoke } from '@tauri-apps/api/core'

invoke('plugin:share|share', {
	path,
	mimeType
})

path: ios: /private/var...  | android: /storage/emulated/0/Android...
mimeType: application/pdf | application/zip ....
```


## Share from others app
TODO