export type AIProvider = "openai" | "gemini" | "claude"

export type AIRequestType =
  | "category"
  | "analysis"
  | "savings_plan"
  | "annual"
  | "life_advice"
  | "calendar_advice"

export type AIRequestBody = {
  provider?: AIProvider
  type: AIRequestType
  data:
    | { [key: string]: unknown }
    | string
    | number
    | boolean
}