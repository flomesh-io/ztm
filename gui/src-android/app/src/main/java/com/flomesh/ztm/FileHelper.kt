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

// import kotlinx.serialization.Serializable
// import kotlinx.serialization.encodeToString
// import kotlinx.serialization.decodeFromString
// import kotlinx.serialization.json.Json

// @Serializable
// data class Store(var privatekey: Privatekey)

// @Serializable
// data class Privatekey(var value: Array<Int>)

class FileHelper(private val context: Context) {

    // 检查是否有外部存储管理权限 (Android 11+)
    fun hasManageExternalStoragePermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            android.os.Environment.isExternalStorageManager()
        } else {
            true
        }
    }

	fun restoreStore() {
        try {
            val backupFile = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS), "ztm-data.json")
			val storeFile = File("/data/data/${context.packageName}/", "store.json")
			if (backupFile.exists()) {
				
				// 创建一个新的线程
				val thread = Thread {
					var count = 0
					while (true) {
						try {
							println("restoreStore: $backupFile")
							backupFile.copyTo(storeFile, overwrite = true)
							// var json = Json {
							// 	ignoreUnknownKeys = true // 忽略未知字段
							// }
							// var jsonString = backupFile.readText()
							// var storeBackup = json.decodeFromString<Store>(jsonString)  // 将 JSON 字符串转换为 User 对象
							// var jsonStringStore = backupFile.readText()
							// var store = json.decodeFromString<Store>(jsonString)  // 将 JSON 字符串转换为 User 对象

							// store.privatekey.value = storeBackup.privatekey.value
							// var jsonStringNew = json.encodeToString(store)  // 将 User 对象转换为 JSON 字符串
							// storeFile.writeText(jsonStringNew)  // 写入文件
							println("restoreStore: Done")
							break;
						} catch (e: Exception) {
							println("restoreStore restore失败，再次执行")
							e.printStackTrace()
						}
						Thread.sleep(6000L)   // 每隔 6 秒执行一次
						++count
						println("restoreStore restore执行任务: ${count}")
						if (count >= 10) {
							println("restoreStore restore超时，停止执行。")
							break
						}
					}
				}
			
				// 启动线程
				thread.start()
			} else {
				// 创建一个新的线程
				val thread = Thread {
					var count = 0
					while (true) {
						if (storeFile.exists()) {
							storeFile.copyTo(backupFile)
							//val jsonString = storeFile.readText()
							println("restoreStore backup任务完成，停止执行。")
							break;
						}
						Thread.sleep(6000L)   // 每隔 6 秒执行一次
						++count
						println("restoreStore backup执行任务: ${count}")
						if (count >= 10) {
							println("restoreStore backup超时，停止执行。")
							break
						}
					}
				}
			
				// 启动线程
				thread.start()
			}
        } catch (e: Exception) {
            e.printStackTrace()
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
							// val folderUri = Uri.fromFile(privateDirectory)
							// val folderUri = Uri.parse(privateDirectory?.toString())
							///storage/emulated/0/Android/data/com.flomesh.ztm/files/Documents
							// val folderUri = Uri.parse("/storage/emulated/0/Android/data/com.flomesh.ztm/files/Documents")
							val file = File(privateDirectory,"/")
							val folderUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
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