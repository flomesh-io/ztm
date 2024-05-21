package com.ztm.ztmapp

import android.os.Bundle
import android.content.Intent
import androidx.appcompat.app.AppCompatActivity

class MainActivity : TauriActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 调用CopyBinaryActivity来复制binary文件
        CopyBinaryActivity.start(this);
    }
}
