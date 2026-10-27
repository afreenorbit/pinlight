export function isReviewFormatError(error){
 return error?.name==='ZodError'||/tool_use_failed|tool call validation|failed to parse tool|did not return a complete result/i.test(`${error?.message||''} ${error?.data?.error?.code||''}`);
}

export async function withReviewRepair(generate){
 for(let attempt=0;attempt<2;attempt++){
  try{return await generate(attempt);}
  catch(error){
   if(isReviewFormatError(error)){
    if(attempt===0)continue;
    throw Object.assign(Error('The AI could not format this review correctly. Please try again; your idea and parts are still in the form.'),{status:502});
   }
   if(error?.statusCode===429)throw Object.assign(Error('The AI service is busy. Wait a minute, then try the review again. Your inputs are still here.'),{status:429});
   if(error?.name==='AbortError'||error?.name==='TimeoutError')throw Object.assign(Error('The review took too long. Please try again; your inputs are still here.'),{status:504});
   if(error?.statusCode)throw Object.assign(Error('The AI service could not complete this review. Please try again shortly.'),{status:502});
   throw error;
  }
 }
}
