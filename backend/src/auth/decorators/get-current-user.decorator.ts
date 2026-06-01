import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetCurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Normalize user shape for backward compatibility:
    // - If JWT provides `userId` but code expects `user._id`, map it so controllers using `user._id` keep working.
    if (user && user.userId && !user._id) {
      // keep original type (string) — many controllers call `user._id.toString()`
      user._id = user.userId;
    }

    return data ? user?.[data] : user;
  },
);
