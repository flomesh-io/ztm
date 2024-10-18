import { invoke } from '@tauri-apps/api/core';
const applePay = ({amount, callback}) => {
  if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
		// 设置支付请求
		const paymentRequest = {
			countryCode: 'US', // 国家代码（美国）
			currencyCode: 'USD', // 货币代码（美元）
			supportedNetworks: ['visa', 'masterCard', 'amex'], // 支持的支付网络
			merchantCapabilities: ['supports3DS'], // 商户能力
			total: {
				label: 'ztm',
				amount // 支付金额（例如 10 美元）
			}
		};

		// 创建 Apple Pay 会话
		const session = new ApplePaySession(3, paymentRequest);

		// 处理支付授权事件
		session.onpaymentauthorized = function(event) {
			const paymentData = event.payment.token.paymentData;
			// 这里可以调用服务器接口进行支付处理
			// 示例：调用后端 API 完成支付
			fetch('/your-server-endpoint', {
					method: 'POST',
					body: JSON.stringify(paymentData),
					headers: {
							'Content-Type': 'application/json'
					}
			})
			.then(response => response.json())
			.then(data => {
					if (data.success) {
							session.completePayment(ApplePaySession.STATUS_SUCCESS); // 支付成功
							if(callback)
							callback();
					} else {
							session.completePayment(ApplePaySession.STATUS_FAILURE); // 支付失败
					}
			})
			.catch(() => {
					session.completePayment(ApplePaySession.STATUS_FAILURE); // 支付失败
			});

			// 启动 Apple Pay 会话
			session.begin();
		}
	} else {
			alert('此设备不支持 Apple Pay');
	}
}

async function processPayment(paymentResponse) {
    // 在这里处理支付响应，例如发送到服务器验证支付
    console.log('Processing payment...', paymentResponse);
    // 模拟一个异步处理
    return new Promise(resolve => setTimeout(resolve, 2000));
}

const applePaymentRequest = async ({amount, callback}) => {
	if (!window.PaymentRequest) {
			console.error('PaymentRequest API is not supported in this browser.');
			return;
	}

	// 创建支付请求对象
	const supportedInstruments = [{
			supportedMethods: 'https://apple.com/apple-pay',
			data: {
					version: 3,  // Apple Pay 版本
					merchantIdentifier: 'merchant.com.example',  // 替换为你自己的商家标识符
					merchantCapabilities: ['supports3DS'],
					supportedNetworks: ['visa', 'masterCard'],
					countryCode: 'US',
					currencyCode: 'USD'
			}
	}];

	const details = {
			total: {
					label: 'Total',
					amount: { currency: 'USD', value: amount }  // 设置总金额
			}
	};

	// 创建支付请求
	const request = new PaymentRequest(supportedInstruments, details);

	try {
			// 显示支付 UI 并等待用户确认
			const paymentResponse = await request.show();

			// 处理支付成功
			await processPayment(paymentResponse);

			// 支付完成后关闭 UI
			await paymentResponse.complete('success');
			console.log('Payment successful:', paymentResponse);
	} catch (error) {
			console.error('Payment failed', error);
	}
}
const inAppPay = () => {
	invoke('purchase_product');
	// .then((res)=>{
	// 	console.log(`[pipylib]Result: ${res}`);
	// });
}
export {
	applePay,applePaymentRequest,inAppPay
};