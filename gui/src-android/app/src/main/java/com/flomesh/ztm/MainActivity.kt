package com.flomesh.ztm

import android.os.Bundle
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity

import android.net.Uri
import android.os.Build
import android.provider.Settings

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        CopyBinaryActivity.start(this);
				
				if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
						if (!Settings.canDrawOverlays(this)) {
								val intent = Intent(
										Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
										Uri.parse("package:$packageName")
								)
								startActivityForResult(intent, REQUEST_CODE_OVERLAY_PERMISSION)
						} else {
								startFloatingWindowService()
						}
				} else {
						startFloatingWindowService()
				}
		}

		private fun startFloatingWindowService() {
				val intent = Intent(this, FloatingWindowService::class.java)
				startService(intent)
		}

		override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
				super.onActivityResult(requestCode, resultCode, data)
				if (requestCode == REQUEST_CODE_OVERLAY_PERMISSION) {
						if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
								if (Settings.canDrawOverlays(this)) {
										startFloatingWindowService()
								}
						}
				}
		}

		companion object {
				private const val REQUEST_CODE_OVERLAY_PERMISSION = 1
		}
}
