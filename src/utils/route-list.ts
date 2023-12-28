function getPathFromRegex(regexp: any) {
    return regexp
        .toString()
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
            // if (!layer.route) {
            //     continue;
            // }

            if (layer.name == 'router') {
                listRoutes(routes, basePath + '/' + getPathFromRegex(layer.regexp), layer.handle)
            } else {
                if (!layer.route)
                    continue;

                routes.push({
                    path: `${basePath}${layer.route.path}`,
                    method: Object.keys(layer.route.methods)[0]
                })
            }
        }
    }

    return routes;
};