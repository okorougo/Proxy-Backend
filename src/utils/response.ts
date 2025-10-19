import { Response } from "express";

export const successResponse = (
  res: Response,
  message: string,
  data: any = null,
  status = 200
) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (
  res: Response,
  message: string,
  code:string | null = "SERVER_ERROR",
  status = 500,
  details: any = null
) => {
  return res.status(status).json({
    success: false,
    message,
    code,
    details,
  });
};
