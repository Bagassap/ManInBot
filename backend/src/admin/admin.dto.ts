import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export enum RunStatusFilter {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  ABORTED = 'ABORTED',
}

export class RangeDto {
  /** Rentang hari yang dilihat. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days?: number;
}

export class RunsQueryDto extends RangeDto {
  @IsOptional()
  @IsEnum(RunStatusFilter)
  status?: RunStatusFilter;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Cari pada isi perintah atau email/nama pengguna. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class CreateUserDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';
}

export class UpdateUserDto {
  @IsOptional()
  @IsIn(['USER', 'ADMIN'])
  role?: 'USER' | 'ADMIN';

  /** true = blokir, false = buka blokir. */
  @IsOptional()
  @IsBoolean()
  blocked?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
