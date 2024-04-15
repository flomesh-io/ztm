<template>

	<div class="card">
			<h3>一、启动 xeye 服务  </h3>
			<p class="bg-primary border-round p-3">
				需要在运行服务的机器上先安装 <a style="color: #fff;" href="https://github.com/flomesh-io/pipy/releases" class="font-medium hover:underline">pipy</a>、openssl(3.0以上版本）这2个可执行程序，另外，9090、6060 这2个端口需要可用。
			</p>

			<h5>1. 下载工程</h5>
			<pre class="app-code"><code> git clone https://github.com/polaristech-io/xeye.git </code></pre>

			<h5>2. 启动服务</h5>
			<pre class="app-code"><code>cd xeye/client
pipy pjs/main.js </code></pre>

			<h3>二、使用浏览器测试效果    </h3>
			<h5>1. 安装CA根证书</h5>
			<p>将 CA.crt 证书安装到系统，或者安装到浏览器。</p>
			
			<h5>2. 给浏览器设置 http、https 代理</h5>
			<p>代理地址 xeye服务地址:9090。</p>
			
			<h5>3. 浏览器访问</h5>
			<p>访问 https//flomesh.io/ 等网站。</p>
			
			<h5>4. 查看 xeye GUI 网页</h5>
			<p>浏览器访问 http://xeye服务地址:6060/。</p>
	</div>
</template>

<style lang="scss" scoped>
@media screen and (max-width: 991px) {
    .video-container {
        position: relative;
        width: 100%;
        height: 0;
        padding-bottom: 56.25%;

        iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
    }
}
</style>
