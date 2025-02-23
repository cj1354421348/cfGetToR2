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

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const key = decodeURI(url.pathname.slice(1));

		if (!authorizeRequest(request, env, key)) {
			return new Response('Forbidden\n', { status: 403 });
		}

		switch (request.method) {
			case 'PUT':
				const objectExists = await env.MY_BUCKET.get(key);

				if (objectExists !== null) {
					if (request.headers.get('Overwrite') !== 'true') {
						return new Response('Object Already Exists\n', { status: 409 });
					}
				}

				await env.MY_BUCKET.put(key, request.body);
				return new Response(`Put ${key} successfully!\n`);

			case 'GET':
				const object = await env.MY_BUCKET.get(key);

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
				await env.MY_BUCKET.delete(key);
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