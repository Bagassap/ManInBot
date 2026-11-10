import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class AddMemberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: (typeof ROLES)[number];
}

export class ChangeRoleDto {
  @IsIn(ROLES)
  role!: (typeof ROLES)[number];
}
