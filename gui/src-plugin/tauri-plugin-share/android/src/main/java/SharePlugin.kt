package com.plugin.share

import android.app.Activity
import android.content.Intent
import androidx.core.content.FileProvider
import java.io.File
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import android.util.Log

@InvokeArg
class ShareOptions {
    var path: String = ""
    var mime: String = "text/plain"
    var group: String = ""
}

@TauriPlugin
class SharePlugin(private val activity: Activity): Plugin(activity) {

    @Command
    fun shareFile(invoke: Invoke) {
        val args = invoke.parseArgs(ShareOptions::class.java)
        Log.i("ztmshare", args.path)
        Log.i("ztmshare", args.mime)

        val context = activity.applicationContext
       
        val file = File(args.path)
        // val file = File("/storage/emulated/0/Android/data/com.flomesh.ztm/files/Documents/Readme.txt")
		val uri = FileProvider.getUriForFile(
				context,
				"${context.packageName}.fileprovider",
				file
			)
		val intent = Intent(Intent.ACTION_SEND)
		intent.setDataAndType(uri, args.mime)
		intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
		context.startActivity(intent)
    }
}
