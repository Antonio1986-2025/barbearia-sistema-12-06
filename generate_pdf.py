from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

def generate():
    doc = SimpleDocTemplate("/mnt/documents/funcoes_agente_ia.pdf", pagesize=A4)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#c9a045"),
        alignment=1,
        spaceAfter=20
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=colors.HexColor("#0e0a05"),
        spaceBefore=15,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'BodyStyle',
        parent=styles['Normal'],
        fontSize=12,
        leading=16,
        spaceAfter=10
    )

    content = []
    
    # Title
    content.append(Paragraph("Funções do Agente de IA - Barbearia Status", title_style))
    content.append(Spacer(1, 12))
    
    # Introduction
    content.append(Paragraph("Este documento detalha as capacidades atuais do assistente virtual integrado ao seu sistema de gestão via WhatsApp.", body_style))
    
    # List of functions
    functions = [
        ("1. Atendimento Automático 24/7", "O agente responde instantaneamente a qualquer mensagem enviada para o seu WhatsApp vinculado, garantindo que nenhum cliente fique sem resposta, mesmo fora do horário de expediente."),
        ("2. Agendamento via Link Oficial", "Sempre que o cliente demonstrar interesse em marcar um serviço, a IA envia automaticamente o link oficial de agendamento online."),
        ("3. Consultoria de Serviços e Preços", "A IA explica os serviços oferecidos e tira dúvidas gerais sobre o funcionamento da barbearia, mantendo um tom profissional e acolhedor."),
        ("4. Filtro de Segurança para Grupos", "O sistema ignora automaticamente mensagens vindas de grupos, garantindo que a IA foque apenas no atendimento individual ao cliente."),
        ("5. Compreensão de Linguagem Natural", "Utilizando o modelo GPT-4o, o agente entende gírias e variações na fala, mantendo uma conversa natural e fluida com o cliente.")
    ]
    
    for title, desc in functions:
        content.append(Paragraph(title, header_style))
        content.append(Paragraph(desc, body_style))
    
    # Conclusion
    content.append(Spacer(1, 20))
    content.append(Paragraph("Gerado automaticamente pelo sistema de gestão Barbearia Status.", body_style))
    
    doc.build(content)

if __name__ == "__main__":
    generate()
