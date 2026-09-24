import { z } from "zod";
import { REPORT_TYPES } from "@/lib/report-types";

/* Shared by the form (instant feedback) and createReport (the real gate). */
export const reportFormSchema = z
  .object({
    type: z.enum(REPORT_TYPES, {
      errorMap: () => ({ message: "Selecione o tipo do problema" }),
    }),
    description: z.string().trim().max(280, "Use no máximo 280 caracteres na descrição"),
    address: z.string().trim().min(5, "Informe ou confirme o endereço do problema").max(250),
    name: z.string().trim().min(3, "Informe seu nome completo").max(100),
    whatsapp: z
      .string()
      .trim()
      .min(10, "Informe um WhatsApp com DDD")
      .max(20)
      .regex(/^[0-9()+\-\s]+$/, "Use apenas números, espaços e parênteses"),
  })
  .superRefine((data, ctx) => {
    if (data.type === "outro" && data.description.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["description"],
        message: "Descreva o problema com pelo menos 10 caracteres",
      });
    }
  });

export const PHOTO_REQUIRED_MESSAGE = "Tire ou escolha uma foto do problema.";

export const reportInputSchema = reportFormSchema.and(
  z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    photo: z.string({ required_error: PHOTO_REQUIRED_MESSAGE }).min(1, PHOTO_REQUIRED_MESSAGE),
  }),
);

export type ReportInput = z.infer<typeof reportInputSchema>;
