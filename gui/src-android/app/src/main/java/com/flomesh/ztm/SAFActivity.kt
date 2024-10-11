package com.flomesh.ztm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.DocumentsContract
import androidx.appcompat.app.AppCompatActivity

class SAFActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openDocumentTree() // 启动 SAF 目录选择器
    }

    // 启动 SAF 目录选择器
    private fun openDocumentTree() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        startActivityForResult(intent, REQUEST_CODE_OPEN_DOCUMENT_TREE)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CODE_OPEN_DOCUMENT_TREE && resultCode == Activity.RESULT_OK) {
            val uri: Uri? = data?.data
            uri?.let {
                // 授予持久的读写权限
                contentResolver.takePersistableUriPermission(
                    it, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                )

                // 返回结果给 MainActivity
                val resultIntent = Intent()
                resultIntent.data = it
                setResult(Activity.RESULT_OK, resultIntent)
                finish()
            }
        }
    }

    companion object {
        const val REQUEST_CODE_OPEN_DOCUMENT_TREE = 100
				const val REQUEST_CODE_SAF = 101
		    fun start(context: Context) {
		        val intent = Intent(context, SAFActivity::class.java)
		        context.startActivity(intent)
		    }
		}
}