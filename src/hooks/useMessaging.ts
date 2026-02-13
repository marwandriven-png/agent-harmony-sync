import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSendWhatsApp() {
  return useMutation({
    mutationFn: async ({
      leadId,
      message,
      campaignId,
      templateName,
      templateVariables,
    }: {
      leadId: string;
      message?: string;
      campaignId?: string;
      templateName?: string;
      templateVariables?: Record<string, string>;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          lead_id: leadId,
          campaign_id: campaignId,
          message,
          template_name: templateName,
          template_variables: templateVariables,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('WhatsApp message sent');
    },
    onError: (error) => {
      toast.error(`WhatsApp failed: ${error.message}`);
    },
  });
}

export function useSendEmail() {
  return useMutation({
    mutationFn: async ({
      leadId,
      subject,
      body,
      campaignId,
      fromName,
      fromEmail,
    }: {
      leadId: string;
      subject: string;
      body: string;
      campaignId?: string;
      fromName?: string;
      fromEmail?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          lead_id: leadId,
          campaign_id: campaignId,
          subject,
          body,
          from_name: fromName,
          from_email: fromEmail,
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Email sent successfully');
    },
    onError: (error) => {
      toast.error(`Email failed: ${error.message}`);
    },
  });
}
