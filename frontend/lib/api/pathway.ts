import { createResourceClient } from "./resource";

export type CareCategory = {
  id: number;
  name_th: string;
  name_en: string;
};
export type CareCategoryInput = Omit<CareCategory, "id">;

export type PathwayTemplate = {
  id: number;
  care_category: number;
  name_th: string;
  name_en: string;
  is_active: boolean;
};
export type PathwayTemplateInput = Omit<PathwayTemplate, "id">;

export type TemplateStep = {
  id: number;
  pathway_template: number;
  service_point: number;
  sequence_order: number;
  prerequisite_steps: number[];
};
export type TemplateStepInput = Omit<TemplateStep, "id">;

export const careCategoriesApi = createResourceClient<CareCategory, CareCategoryInput>("/pathway/care-categories");
export const pathwayTemplatesApi = createResourceClient<PathwayTemplate, PathwayTemplateInput>(
  "/pathway/pathway-templates",
);
export const templateStepsApi = createResourceClient<TemplateStep, TemplateStepInput>("/pathway/template-steps");
