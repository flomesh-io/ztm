package com.flomesh.ztm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import android.os.Build

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            Toast.makeText(context, "Device Boot Completed", Toast.LENGTH_SHORT).show()
            val serviceIntent = Intent(context, FloatingWindowService::class.java)
						if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
								context?.startForegroundService(serviceIntent)
						} else {
								context?.startService(serviceIntent)
						}
        }
    }
}
