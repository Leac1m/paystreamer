#!/usr/bin/env node

console.log("1. Testing imports...");

try {
    console.log("2. Importing GrpcTransport...");
    const { GrpcTransport } = await import('@protobuf-ts/grpc-transport');
    console.log("3. GrpcTransport imported:", typeof GrpcTransport);
    
    console.log("4. Importing ChannelCredentials...");
    const { ChannelCredentials } = await import('@grpc/grpc-js');
    console.log("5. ChannelCredentials imported:", typeof ChannelCredentials);
    
    console.log("6. Creating transport...");
    const transport = new GrpcTransport({
        host: 'fullnode.devnet.sui.io:443',
        channelCredentials: ChannelCredentials.createSsl(),
    });
    console.log("7. Transport created!");
    
} catch (error) {
    console.error("ERROR:", error);
    process.exit(1);
}
