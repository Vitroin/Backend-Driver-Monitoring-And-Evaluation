import { User } from "@modules/users/user.model";
import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user: User;
}