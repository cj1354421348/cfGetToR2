const hasValidHeader = (request, env) => {
    return request.headers.get('X-Custom-Auth-Key') === env.AUTH_KEY_SECRET;
};

function authorizeRequest(request, env) {
    switch (request.method) {
        case 'PUT':
        case 'DELETE':
            return hasValidHeader(request, env);
        case 'GET':
            return true;
        default:
            return false;
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        
        // 解析路径格式：/${bucketName}/${objectKey}
        const pathSegments = url.pathname.slice(1).split('/');
        
        // 验证路径格式
        if (pathSegments.length < 2) {
            return new Response('Invalid path format. Use /bucket-name/key', { status: 400 });
        }

        const [bucketName, ...keyParts] = pathSegments;
        const key = keyParts.join('/');

        // 获取对应的存储桶实例
        const bucket = env[bucketName];
        if (!bucket) {
            return new Response('Bucket Not Found\n', { status: 404 });
        }

        if (!authorizeRequest(request, env)) {
            return new Response('Forbidden\n', { status: 403 });
        }

        switch (request.method) {
            case 'PUT':
                const objectExists = await bucket.get(key);
                if (objectExists !== null) {
                    if (request.headers.get('Overwrite') !== 'true') {
                        return new Response('Object Already Exists\n', { status: 409 });
                    }
                }
                await bucket.put(key, request.body);
                return new Response(`Put ${key} to ${bucketName} successfully!\n`);

            case 'GET':
                const object = await bucket.get(key);
                if (object === null) {
                    return new Response('Object Not Found\n', { status: 404 });
                }
                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);
                return new Response(object.body, { headers });

            case 'DELETE':
                await bucket.delete(key);
                return new Response(`Deleted ${key} from ${bucketName}!\n`);

            default:
                return new Response('Method Not Allowed\n', {
                    status: 405,
                    headers: { Allow: 'PUT, GET, DELETE' },
                });
        }
    },
};
