import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      email,
      patientName,
      serviceName,
      appointmentDate,
      appointmentTime,
      status,
    } = body;

    if (!email || !patientName || !appointmentDate || !appointmentTime) {
      return NextResponse.json(
        { error: "Missing required information." },
        { status: 400 }
      );
    }

    const isConfirmed = status === "confirmed";

    const subject = isConfirmed
      ? "Your appointment has been confirmed - DR. BRITNEY"
      : "Appointment update - DR. BRITNEY";

    const title = isConfirmed
      ? "Appointment Confirmed"
      : "Appointment Cancelled";

    const message = isConfirmed
      ? `Your appointment with DR. BRITNEY has been confirmed.`
      : `We are sorry to inform you that your appointment with DR. BRITNEY has been cancelled.`;

    const { data, error } = await resend.emails.send({
      from: "DR. BRITNEY <onboarding@resend.dev>",
      to: [email],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; color: #222;">
          
          <h1 style="margin-bottom: 10px;">
            DR. BRITNEY
          </h1>

          <h2>
            ${title}
          </h2>

          <p>
            Hello ${patientName},
          </p>

          <p>
            ${message}
          </p>

          <div style="background: #f7f7f7; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <p><strong>Service:</strong> ${serviceName || "Dental Appointment"}</p>
            <p><strong>Date:</strong> ${appointmentDate}</p>
            <p><strong>Time:</strong> ${appointmentTime}</p>
          </div>

          ${
            isConfirmed
              ? `
                <p>
                  We look forward to seeing you.
                </p>
              `
              : `
                <p>
                  If you would like to book another appointment,
                  please contact the clinic.
                </p>
              `
          }

          <p style="margin-top: 30px; color: #777;">
            DR. BRITNEY Dental Clinic
          </p>

        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Email API error:", error);

    return NextResponse.json(
      { error: "Failed to send email." },
      { status: 500 }
    );
  }
}