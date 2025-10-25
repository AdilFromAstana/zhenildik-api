import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Promo Catalog API')
    .setDescription('API для каталога акций и категорий')
    .setVersion('1.0')
    .addTag('categories')
    .build();

  app.enableCors({ origin: '*' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // отсекает лишние поля
      forbidNonWhitelisted: true, // кидает ошибку на неизвестные поля
      transform: true, // автоматически преобразует типы
    }),
  );

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 5000);
  console.log(
    `🚀 Server running on http://localhost:${process.env.PORT ?? 5000}`,
  );
  console.log(
    `📘 Swagger docs available at http://localhost:${process.env.PORT ?? 5000}/api/docs`,
  );
}
bootstrap();
