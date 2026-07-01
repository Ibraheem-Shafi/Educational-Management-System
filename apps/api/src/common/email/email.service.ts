import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as Handlebars from 'handlebars';
import nodemailer, { type Transporter } from 'nodemailer';

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
  messageId?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.transporter = this.createTransporter();
  }

  private createTransporter(): Transporter | null {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS) — emails will be logged only');
      return null;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  private templatesDir(): string {
    const candidates = [
      join(__dirname, '..', '..', 'templates', 'email'),
      join(process.cwd(), 'src', 'templates', 'email'),
      join(process.cwd(), 'apps', 'api', 'src', 'templates', 'email'),
    ];
    for (const dir of candidates) {
      if (existsSync(join(dir, 'layout.hbs'))) return dir;
    }
    return candidates[0];
  }

  private loadTemplate(name: string): HandlebarsTemplateDelegate {
    const cached = this.compiledTemplates.get(name);
    if (cached) return cached;

    const filePath = join(this.templatesDir(), `${name}.hbs`);
    if (!existsSync(filePath)) {
      throw new Error(`Email template not found: ${filePath}`);
    }

    const source = readFileSync(filePath, 'utf8');
    const compiled = Handlebars.compile(source);
    this.compiledTemplates.set(name, compiled);
    return compiled;
  }

  private renderEmail(
    templateName: string,
    context: Record<string, unknown>,
    institutionName: string,
    subject: string,
  ): string {
    const primaryColor = (context.primaryColor as string) ?? '#2563eb';
    const bodyHtml = this.loadTemplate(templateName)({
      ...context,
      institutionName,
      primaryColor,
    });
    return this.loadTemplate('layout')({
      subject,
      institutionName,
      primaryColor,
      body: bodyHtml,
    });
  }

  async sendTemplatedEmail(options: {
    to: string;
    subject: string;
    template: string;
    context: Record<string, unknown>;
    institutionName?: string;
  }): Promise<SendEmailResult> {
    const from = this.config.get<string>('EMAIL_FROM') ?? 'noreply@example.com';
    const institutionName =
      options.institutionName ??
      this.config.get<string>('INSTITUTION_NAME') ??
      'Institution';

    const html = this.renderEmail(options.template, options.context, institutionName, options.subject);

    if (!this.transporter) {
      this.logger.warn(`SMTP not configured — email not sent to ${options.to}`);
      this.logger.log(`Subject: ${options.subject}`);
      return { sent: false, reason: 'email_not_configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html,
      });
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to send email to ${options.to}: ${message}`);
      return { sent: false, reason: 'provider_error' };
    }
  }

  async sendInvitationEmail(
    to: string,
    inviteUrl: string,
    institutionName: string,
    primaryColor = '#2563eb',
  ): Promise<SendEmailResult> {
    return this.sendTemplatedEmail({
      to,
      subject: `You're invited to ${institutionName}`,
      template: 'invitation',
      institutionName,
      context: { inviteUrl, primaryColor },
    });
  }
}
