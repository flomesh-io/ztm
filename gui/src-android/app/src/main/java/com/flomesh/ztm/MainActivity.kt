package com.flomesh.ztm

import android.os.Bundle
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity

import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.ActivityResultLauncher

class MainActivity : TauriActivity() {

    private lateinit var overlayPermissionLauncher: ActivityResultLauncher<Intent>
    private lateinit var fileHelper: FileHelper
		
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CopyBinaryActivity.start(this)

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
						// // 保存文件到公共 Documents 目录并打开它
						// val uri: Uri? = fileHelper.saveFileToDocuments("Readme.txt", "Welcome ZTM!")
						// uri?.let { fileHelper.openFile(it) }
				}
    }

    private fun startFloatingWindowService() {
        val intent = Intent(this, FloatingWindowService::class.java)
        startService(intent)
    }
}
