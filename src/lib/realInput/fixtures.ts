export const SYNTHETIC_CRM_CSV = `event_id,lead_id,occurred_at,actor_id,actor_role,channel,event_type,direction,source_ref,text_or_summary,crm_stage,contact_phone,project,developer,unit,budget,area_location,payment_plan_context
crm-001,lead-synth-001,2026-08-24 09:15,rep-synth-01,REP,CRM,LEAD_ASSIGNED,INTERNAL,crm-export:synthetic:1,Lead assigned,New,+201001112233,Palm Grove,Nile Developments,A-12,4500000,New Cairo,10% over 8 years
crm-002,lead-synth-001,2026-08-24T09:20:00+02:00,buyer-synth-01,BUYER,CRM,BUYER_NOTE,INBOUND,crm-export:synthetic:2,"Buyer requested details in Arabic: أرسل التفاصيل من فضلك",Contacted,+20 100 111 2233,Palm Grove,Nile Developments,A-12,4500000,New Cairo,10% over 8 years`;

export const SYNTHETIC_WHATSAPP_EXPORT = `[24/08/2026, 10:20:00] - Buyer Synth: صباح الخير، أرسل التفاصيل من فضلك
My email is buyer@example.test
[24/08/2026, 10:23:00] - Rep Synth: حاضر، هذه معاينة فقط ولن يتم إرسال شيء من النظام.`;
