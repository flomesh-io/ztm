//
//  AppProxyProvider.swift
//  ProxyWidget
//
//  Created by 林东臣 on 2024/9/16.
//

import NetworkExtension

//@_silgen_name("pipy_main") func pipy_main(argc: Int32, argv: UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>) -> Int32

class AppProxyProvider: NEAppProxyProvider {

    func playPipy() {
        // Get the document directory path
        DispatchQueue.global(qos: .default).async {
            for progress in stride(from: 0.0, to: 100.0, by: 1.0) {
                let paths = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)
                guard let documentDirectory = paths.first else {
                    NSLog("调试-Could not find document directory")
                    return
                }
                
                let ztmdbPath = documentDirectory.appendingPathComponent("ztmdb").path
                let ztmlogPath = documentDirectory.appendingPathComponent("log.txt").path
                NSLog("调试-libpipy documentDirectory is \(documentDirectory.path)")
                
                // Create the argument list
                var args = ["--pipy", "repo://ztm/agent", "--args", "--data", ztmdbPath, "--listen", "7777", "--pipy-options", "--log-file=\(ztmlogPath)"]
                
                let cArgs = args.map { strdup($0) }
                defer { cArgs.forEach { free($0) } }  // 确保释放内存
                
                // 创建 UnsafeMutablePointer 数组
                let argv = UnsafeMutablePointer<UnsafeMutablePointer<Int8>?>.allocate(capacity: cArgs.count)
                for (index, arg) in cArgs.enumerated() {
                    argv[index] = arg
                }
                argv[cArgs.count] = nil // 添加 null 终止符
                
//                // Call the pipy_main function
//                let result = pipy_main(argc: Int32(cArgs.count), argv: argv)
//
//                // Log the result
//                NSLog("调试-callPipyMain pipy_main returned: \(result)")
            }
        };
    }
    
    override init() {
        NSLog("调试-AppProxyProvider: init")
        super.init()
        playPipy();
    }
    override func startProxy(options: [String : Any]? = nil, completionHandler: @escaping (Error?) -> Void) {
        
        NSLog("调试-AppProxyProvider: startProxy")
        playPipy()
        // Add code here to start the process of connecting the tunnel.
    }
    
    override func stopProxy(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        // Add code here to start the process of stopping the tunnel.
        completionHandler()
    }
    
    override func handleAppMessage(_ messageData: Data, completionHandler: ((Data?) -> Void)?) {
        // Add code here to handle the message.
        if let handler = completionHandler {
            handler(messageData)
        }
    }
    
    override func sleep(completionHandler: @escaping() -> Void) {
        // Add code here to get ready to sleep.
        completionHandler()
    }
    
    override func wake() {
        // Add code here to wake up.
    }
    
    override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        // Add code here to handle the incoming flow.
        return false
    }
}
