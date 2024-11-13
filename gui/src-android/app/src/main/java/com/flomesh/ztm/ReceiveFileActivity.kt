package com.flomesh.ztm

import android.content.ContentResolver
import android.database.Cursor
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.documentfile.provider.DocumentFile
import android.provider.MediaStore
import java.io.FileOutputStream
import java.io.InputStream
import java.io.FileInputStream;
import java.io.File

class ReceiveFileActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 处理分享的文件
        handleSharedFile(this, intent)
    }


    private fun handleSharedFile(context: Context, intent: Intent?) {
        intent?.action?.takeIf { it == Intent.ACTION_SEND }?.let {
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM) ?: return@let

            // 获取原始文件名
            val fileName = getFileNameFromUri(context, uri) ?: "unknown_file"

            saveFileToPrivateStorage(context, uri, fileName)
        }
    }

    private fun saveFileToPrivateStorage(context: Context, uri: Uri, fileName: String) {
        val resolver = contentResolver
        val inputStream: InputStream? = if (uri.scheme == ContentResolver.SCHEME_CONTENT) {
            resolver.openInputStream(uri)
        } else if (uri.scheme == ContentResolver.SCHEME_FILE) {
            FileInputStream(uri.path)
        } else {
            null
        }

        inputStream?.use { input ->
            val appDir = context.filesDir
            val tmpDir = File(appDir, "tmp")
            if (!tmpDir.exists()) {
                tmpDir.mkdirs() // 创建目录（包括任何必要的但不存在的父目录）
            } else {
                deleteAllFilesInDir(tmpDir)
            }
            val path = File(tmpDir, fileName)
            val outputStream = FileOutputStream(path)
            val buffer = ByteArray(1024)
            var bytesRead: Int

            while (input.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
            }

            outputStream.flush()

            if (path.exists()) {
                println("File saved to private storage: ok")
            }
        }
    }
    fun deleteAllFilesInDir(dir: File) {
        // 列出目录中的所有文件和子目录
        val files = dir.listFiles() ?: return // 如果目录为空或不存在，直接返回

        // 遍历数组并删除文件和子目录
        for (file in files) {
            if (file.isDirectory) {
                // 如果是子目录，递归删除其子文件和子目录
                deleteAllFilesInDir(file)
                // 最后删除空子目录本身
                file.delete()
            } else {
                // 如果是文件，直接删除
                file.delete()
            }
        }
    }

    fun getFileNameFromUri(context: Context, uri: Uri): String? {
        val resolver = context.contentResolver
        return if (uri.scheme == ContentResolver.SCHEME_CONTENT) {
            // 查询文件的元数据
            val cursor: Cursor? = resolver.query(uri, null, null, null, null)
            cursor?.use {
                it.moveToFirst()
                val nameIndex = it.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
                if (nameIndex >= 0) {
                    it.getString(nameIndex)
                } else {
                    null
                }
            }
        } else if (uri.scheme == ContentResolver.SCHEME_FILE) {
            // 从文件路径中提取文件名
            val path = uri.path
            path?.substringAfterLast('/')
        } else {
            null
        }
    }   
    
}

