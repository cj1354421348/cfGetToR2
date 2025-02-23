const hasValidHeader = (request, env) => {
    return request.headers.get('X-Custom-Auth-Key') === env.AUTH_KEY_SECRET;
};

function authorizeRequest(request, env, key) {
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

async function getBucket(env, bucketName) {
    // Assumes each bucket has a corresponding binding in the env
    if (env[bucketName]) {
        return env[bucketName];
    } else {
        return null;
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathSegments = url.pathname.slice(1).split('/');
        
        // Get the bucket name and key from the path (e.g., /bucket1/filename -> bucket1, filename)
        const bucketName = pathSegments[0];
        const key = pathSegments.slice(1).join('/');

        // Get the bucket based on the name from the environment
        const bucket = await getBucket(env, bucketName);

        if (!bucket) {
            return new Response('Bucket Not Found\n', { status: 404 });
        }

        if (!authorizeRequest(request, env, key)) {
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

                return new Response(object.body, {
                    headers,
                });

            case 'DELETE':
                await bucket.delete(key);
                return new Response('Deleted!\n');

            default:
                return new Response('Method Not Allowed\n', {
                    status: 405,
                    headers: {
                        Allow: 'PUT, GET, DELETE',
                    },
                });
        }
    },
};
