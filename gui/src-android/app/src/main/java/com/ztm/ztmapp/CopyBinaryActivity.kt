package com.flomesh.ztm

import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

class CopyBinaryActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 复制binary文件到私有目录
        copyBinaryToPrivateDir(this, "libc++_shared.so")
        copyBinaryToPrivateDir(this, "libztm.so")
        // 完成后返回结果给主Activity
        setResult(RESULT_OK)
        finish()
    }

    private fun copyBinaryToPrivateDir(context: Context, fileName: String) {
        var inputStream: InputStream? = null
        var outputStream: OutputStream? = null
        try {
            inputStream = context.assets.open(fileName)
            val outFile = File(context.filesDir, fileName)
            outputStream = FileOutputStream(outFile)

            val buffer = ByteArray(1024)
            var length: Int
            while (inputStream.read(buffer).also { length = it } > 0) {
                outputStream.write(buffer, 0, length)
            }

            // 设置文件权限为可执行
            outFile.setExecutable(true, false)
        } catch (e: IOException) {
            e.printStackTrace()
        } finally {
            try {
                inputStream?.close()
                outputStream?.close()
            } catch (e: IOException) {
                e.printStackTrace()
            }
        }
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, CopyBinaryActivity::class.java)
            context.startActivity(intent)
        }
    }
}
