package com.flomesh.ztm

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import android.widget.Toast

class ReceiveFileActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 获取Intent
        val intent = intent
        // 检查action是否为分享动作
        if (Intent.ACTION_SEND == intent.action) {
            // 获取文件Uri
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            if (uri != null) {
                // 这里你可以根据Uri来处理文件，比如读取文件内容或显示文件
                // 在这个例子中，我们简单地显示一个Toast来表示接收到了文件
                Toast.makeText(this, "接收到了文件: $uri", Toast.LENGTH_LONG).show()

                // 如果你需要处理文件，可以在这里添加代码，比如使用ContentResolver来读取文件内容
            } else {
                Toast.makeText(this, "没有接收到文件", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
