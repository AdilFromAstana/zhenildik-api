import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Promo Catalog API')
    .setDescription('API для каталога акций и категорий')
    .setVersion('1.0')
    .addTag('categories')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Введите JWT токен (без "Bearer " — только сам токен)',
        in: 'header',
      },
      'access-token', // имя схемы — должно совпадать с @ApiBearerAuth()
    )
    .build();

  app.enableCors({ origin: '*' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true, // ✅ ключевой параметр
      transformOptions: { enableImplicitConversion: true }, // ✅ для вложенных DTO
    }),
  );

  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

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
