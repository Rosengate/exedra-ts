import { Controller, Path, Get, Post, Param, Body, Query, Header, State, Flag, Series } from '../../../src';
import DeviceScreensController from "./DeviceScreensController";

@Path('/devices')
@State('resource', 'random')
@Flag('ajax')
export default class DevicesController extends Controller {
  @Get('')
  @Series('transformer', 'list')
  @State('need_auth', true)
  getAll(limit: number, offset: number) {
    return {
      devices: [],
      limit,
      offset,
    };
  }

  @Get('/:device')
  @State('need_auth', true)
  @Flag('verbose')
  getDevice(@Param('device') id: string) {
    return {
      device: id,
    };
  }

  @Post('')
  createDevice(@Body('name') name: string, @Body('model') model: string) {
    return {
      name,
      model,
    };
  }

  groupScreens() {
    return DeviceScreensController;
  }

  @Get('/:device/settings')
  getSettings(
    @Param('device') id: string,
    @Query('format') format: string,
    @Header('authorization') token: string,
  ) {
    return {
      device: id,
      format,
      authenticated: !!token,
    };
  }

  @Get('/:device/meta')
  getMeta(
    @State('resource') resource: string,
    @Flag('ajax') isAjax: boolean,
    @Flag('verbose') isVerbose: boolean,
    @Series('transformer') transformers: any[],
    @State('need_auth') needAuth: boolean,
  ) {
    return {
      resource,
      isAjax,
      isVerbose,
      transformers,
      needAuth,
    };
  }
}
