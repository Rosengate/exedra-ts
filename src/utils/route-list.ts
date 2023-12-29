function getPathFromRegex(regexp: any) {
    return regexp
        .toString()
        .replace('?/i', '')
        .replace('/^', '')
        .replace('?(?=\\/|$)/i', '')
        .replace(/\\\//g, '/')
        .replace('(?:/(?=$))', '');
}

// const routes: any[] = [];

const trimEnd = (str: string, toRemove: string) => str.endsWith(toRemove) ? str.slice(0, -toRemove.length) : str;
const trimStart = (str: string, toRemove: string) => str.startsWith(toRemove) ? str.slice(toRemove.length) : str;
const trimBoth = (str: string, toRemove: string) => trimEnd(trimStart(str, toRemove), toRemove);

export const listRoutes = (routes: any[], basePath = '/', router: any) => {
    basePath = '/' + trimBoth(basePath, '/')
    if (router && router.stack) {
        for (const layer of router.stack) {
            if (layer.name == 'router') {
                let groupPath;
                if (layer.keys && layer.keys.length > 0) {
                    groupPath = layer.keys.map((key: any) => '/:' + key.name).join('')
                } else {
                    groupPath = getPathFromRegex(layer.regexp);
                }

                console.log(layer)

                listRoutes(routes, basePath + '/' + groupPath, layer.handle)
            } else {
                if (!layer.route)
                    continue;

                routes.push({
                    path: trimEnd(`${basePath}${layer.route.path}`.replaceAll('///', '/').replaceAll('//', '/'), '/'),
                    method: Object.keys(layer.route.methods)[0].toUpperCase()
                })
            }
        }
    }

    return routes;
};