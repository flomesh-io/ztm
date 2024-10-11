package com.flomesh.ztm

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import android.os.Environment
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.util.Log
class FileHelper(private val context: Context) {

    // 检查是否有外部存储管理权限 (Android 11+)
    fun hasManageExternalStoragePermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.os.Environment.isExternalStorageManager()
        } else {
            true
        }
    }

    // 请求外部存储管理权限
    fun requestManageExternalStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
            intent.data = Uri.parse("package:${context.packageName}")//${context.packageName}
            context.startActivity(intent)
        }
    }
		
		fun createDirectory() {
				// 获取公共存储目录
				val externalStorageDir = File("/storage/emulated/0/${context.packageName}")
				
				// 检查目录是否存在
				if (!externalStorageDir.exists()) {
						// 尝试创建目录
						if (externalStorageDir.mkdirs()) {
								Log.d("Storage", "Directory created successfully")
						} else {
								Log.e("Storage", "Failed to create directory")
						}
				} else {
						Log.d("Storage", "Directory already exists")
				}
		}
    // 保存文件到公共 Documents 目录
    fun saveFileToDocuments(fileName: String, content: String): Uri? {
        val resolver = context.contentResolver
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
            put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
            put(MediaStore.MediaColumns.RELATIVE_PATH, "ztm/")
        }

        val uri: Uri? = resolver.insert(MediaStore.Files.getContentUri("external"), contentValues)
        uri?.let {
            resolver.openOutputStream(it)?.use { outputStream ->
                outputStream.write(content.toByteArray())
            }
        }
        return uri
    }

    // 打开文件
    fun openFile(uri: Uri) {
        val intent = Intent(Intent.ACTION_VIEW)
        intent.setDataAndType(uri, "text/plain")
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(intent)
    }

    // 直接打开外部文件路径 (如 /storage/emulated/0/...)
    fun openExternalFile(filePath: String) {
        val file = File(filePath)
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

        val intent = Intent(Intent.ACTION_VIEW)
        intent.setDataAndType(uri, "text/plain")
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(intent)
    }
		
    fun createShortcut() {
			// 确保使用 Android 8.0 (API 26) 及以上版本的快捷方式管理器
			    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
							Log.d("FileHelper", "Start")
			        val shortcutManager = context.getSystemService(ShortcutManager::class.java)
			        // 生成指向私有文件夹的 Uri
			        val privateDirectory = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS)
							val folderUri = Uri.fromFile(privateDirectory)
							// val folderUri = Uri.parse(privateDirectory?.toString())
							// val folderUri = Uri.parse("/storage/emulated/0/com.flomesh.ztm")
							// 创建意图
							val intent = Intent(Intent.ACTION_VIEW).apply {
									// data = folderUri // 指向私有文件夹的 URI
									setDataAndType(folderUri, "vnd.android.document/directory")
									addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
							}
			
							Log.d("FileHelper", "point 3")
							// 创建快捷方式信息
							val shortcutInfo = ShortcutInfo.Builder(context, "com.flomesh.ztm.documents")
									.setShortLabel("ztm doc")
									.setLongLabel("ZTM Documents")
									.setIcon(Icon.createWithResource(context, R.drawable.ic_launcher)) // 使用你的图标
									.setIntent(intent)
									.build()
			
							Log.d("FileHelper", "point 4")
							// 添加快捷方式
							shortcutManager?.setDynamicShortcuts(listOf(shortcutInfo))
							Log.d("FileHelper", "Shortcut created: ${shortcutInfo.id}")
			    } else {
						// 处理 Android 8.0 以下版本
						// val shortcutIntent = Intent("com.android.launcher.action.INSTALL_SHORTCUT")
						// shortcutIntent.putExtra(Intent.EXTRA_SHORTCUT_NAME, "ZTM Documents")
						// shortcutIntent.putExtra(Intent.EXTRA_SHORTCUT_INTENT, intent)
						// shortcutIntent.putExtra("duplicate", false)
						// context.sendBroadcast(shortcutIntent)
					}
    }
}