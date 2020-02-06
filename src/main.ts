import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import config from 'config';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);
    await app.listen(config.get('port'));
    console.log(`Listening at port ${config.get('port')}`);
}
bootstrap();
