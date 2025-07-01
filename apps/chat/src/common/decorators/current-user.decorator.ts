import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CoolJwtPayload } from '../interfaces/payload'; 
// export const CurrentUser = createParamDecorator(
//   (_, ctx: ExecutionContext): JwtPayload => {
//     const request = ctx.switchToHttp().getRequest();
//     return request.user;
//   },
// );

/**
 * Improved version.

 * Lợi ích:

- Gọn gàng hơn (không phải `@CurrentUser() user: JwtPayload` rồi `user.id`).

- Giữ type-safety tốt hơn khi dùng keyof JwtPayload.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CoolJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: CoolJwtPayload = request.user;

    // Nếu truyền 'id', 'email'... thì trả về thuộc tính đó
    // Nếu không truyền gì => trả về toàn bộ object
    return data ? user?.[data] : user;
  },
);
