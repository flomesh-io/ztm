#import <Foundation/Foundation.h>
#import <StoreKit/StoreKit.h>

@interface InAppPayHandler : NSObject <SKProductsRequestDelegate, SKPaymentTransactionObserver>

+ (instancetype)sharedManager;
// - (void)requestProducts;
- (void)purchaseProductWithID;
- (void)restorePurchases;

@end

@implementation InAppPayHandler {
    NSArray<SKProduct *> *_products;
}

+ (instancetype)sharedManager {
    static InAppPayHandler *sharedManager = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedManager = [[InAppPayHandler alloc] init];
    });
    return sharedManager;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _products = [NSArray array];
    }
    return self;
}

// 请求产品列表
// - (void)requestProducts {
//     NSSet *productIdentifiers = [NSSet setWithArray:@[@"com.flomesh.ztm.sub.awshub"]];
//     SKProductsRequest *request = [[SKProductsRequest alloc] initWithProductIdentifiers:productIdentifiers];
//     request.delegate = self;
//     [request start];
// }

// - (void)productsRequest:(SKProductsRequest *)request didReceiveResponse:(SKProductsResponse *)response {
//     _products = response.products;
//     for (SKProduct *product in _products) {
//         NSLog(@"Product available: %@ for %@", product.localizedTitle, product.price);
//     }
// }

- (void)purchaseProductWithID {
    // 发起SKProductsRequest，仅请求指定的productIdentifier
		NSLog(@"start purchaseProductWithID.");
    NSArray *productIdentifiers = @[
			@"com.flomesh.ztm.awshub",
			@"com.flomesh.ztm.sub.awshub"
		];
    SKProductsRequest *productsRequest = [[SKProductsRequest alloc] initWithProductIdentifiers:[NSSet setWithArray:productIdentifiers]];
    productsRequest.delegate = self;
    [productsRequest start];
}

// SKProductsRequestDelegate方法，处理产品信息并发起购买
- (void)productsRequest:(SKProductsRequest *)request didReceiveResponse:(SKProductsResponse *)response {
    SKProduct *product = nil;
		NSLog(@"start productsRequest.");
    for (SKProduct *prod in response.products) {
			NSLog(@"start productsRequest item: %@ ", prod.productIdentifier);
			if ([prod.productIdentifier isEqualToString:@"com.flomesh.ztm.sub.awshub"]) {
					product = prod;
					break;
			}
    }

    if (product) {
        if ([SKPaymentQueue canMakePayments]) {
            SKPayment *payment = [SKPayment paymentWithProduct:product];
            [[SKPaymentQueue defaultQueue] addTransactionObserver:self];
            [[SKPaymentQueue defaultQueue] addPayment:payment];
        } else {
            NSLog(@"In-app purchases are not allowed.");
        }
    } else {
        NSLog(@"Product not found3.");
    }
}

// SKPaymentTransactionObserver - 处理交易状态
- (void)paymentQueue:(SKPaymentQueue *)queue updatedTransactions:(NSArray<SKPaymentTransaction *> *)transactions {
    for (SKPaymentTransaction *transaction in transactions) {
        switch (transaction.transactionState) {
            case SKPaymentTransactionStatePurchased:
                NSLog(@"Purchase successful!");
                [[SKPaymentQueue defaultQueue] finishTransaction:transaction];
                break;
            case SKPaymentTransactionStateFailed:
                NSLog(@"Purchase failed: %@", transaction.error.localizedDescription);
                [[SKPaymentQueue defaultQueue] finishTransaction:transaction];
                break;
            case SKPaymentTransactionStateRestored:
                NSLog(@"Purchase restored.");
                [[SKPaymentQueue defaultQueue] finishTransaction:transaction];
                break;
            default:
                break;
        }
    }
}

// 恢复购买
- (void)restorePurchases {
    [[SKPaymentQueue defaultQueue] restoreCompletedTransactions];
}

@end
