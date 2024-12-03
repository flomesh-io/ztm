package com.flomesh.ztm

import android.os.Bundle
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity

import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.ActivityResultLauncher
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.Manifest
import android.content.pm.PackageManager

class MainActivity : TauriActivity() {

		private val REQUEST_FOREGROUND_SERVICE_PERMISSION = 1001
    private lateinit var overlayPermissionLauncher: ActivityResultLauncher<Intent>
    private lateinit var fileHelper: FileHelper
		
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
		
        overlayPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
					if (Settings.canDrawOverlays(this)) {
							startFloatingWindowService()
					}
        }

				if (!Settings.canDrawOverlays(this)) {
						val intent = Intent(
								Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
								Uri.parse("package:$packageName")
						)
						overlayPermissionLauncher.launch(intent)
				} else {
						startFloatingWindowService()
				}
				
				fileHelper = FileHelper(this)
				// 检查并请求外部存储管理权限（Android 11+）
				if (!fileHelper.hasManageExternalStoragePermission()) {
					fileHelper.requestManageExternalStoragePermission()
				} else {
					fileHelper.createDirectory();
						// // 保存文件到公共 Documents 目录并打开它
						// val uri: Uri? = fileHelper.saveFileToDocuments("Readme.txt", "Welcome ZTM!")
						// uri?.let { fileHelper.openFile(it) }
				}

				// 创建一个新的线程
				val thread = Thread {
					var count = 0
					while (true) {
						try {
							println("start pipy: check hasManageExternalStoragePermission")
							// 检查并请求外部存储管理权限（Android 11+）
							if (fileHelper.hasManageExternalStoragePermission()) {
								println("start pipy: check hasManageExternalStoragePermission ok")
								CopyBinaryActivity.start(this)
								break;
							}
							println("start pipy: wait hasManageExternalStoragePermission")
							Thread.sleep(6000L)   // 每隔 6 秒执行一次
							++count
							println("start pipy: count ${count}")
							if (count >= 10) {
								println("start pipy: timeout stop")
								break
							}
						}
						catch(e: Exception) {
							println("start pipy e: ${e.message}")
						}
					}
				}
				// 启动线程
				thread.start()


				fileHelper.createShortcut()
				// SAFActivity.start(this)
				fileHelper.restoreStore()
    }

    private fun startFloatingWindowService() {
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
					if (ContextCompat.checkSelfPermission(
									this,
									Manifest.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK
							) != PackageManager.PERMISSION_GRANTED
					) {
							ActivityCompat.requestPermissions(
									this,
									arrayOf(Manifest.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK),
									REQUEST_FOREGROUND_SERVICE_PERMISSION
							)
					} else {
							val intent = Intent(this, FloatingWindowService::class.java)
							startService(intent)
					}
			} else {
				val intent = Intent(this, FloatingWindowService::class.java)
				startService(intent)
			}
    }
		
}
