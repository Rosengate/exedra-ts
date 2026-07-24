import { Controller, Path, Get, Post, Param, Body, Query, Header, Req } from '../../src';

export default class DevicesController extends Controller {
  @Get('')
  getAll(limit: number, offset: number) {
    return {
      devices: [],
      limit,
      offset,
    };
  }

  @Get('/:device')
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
}
