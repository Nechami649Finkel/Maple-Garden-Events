import React from 'react';
import {
  ANNEX_TITLE,
  parseAnnexSections,
  splitContractForDisplay,
} from '../../../utils/contractSections';

interface ContractTextViewerProps {
  text: string;
}

const sectionCardStyle: React.CSSProperties = {
  marginBottom: '14px',
  padding: '14px 16px',
  background: '#ffffff',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 10px',
  color: '#1e293b',
  fontSize: '1rem',
  fontWeight: 700,
  borderBottom: '2px solid #cbd5e1',
  paddingBottom: '6px',
};

const ContractTextViewer: React.FC<ContractTextViewerProps> = ({ text }) => {
  const { mainText, annexText } = splitContractForDisplay(text);

  if (!annexText) {
    return (
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#334155' }}>
        {text}
      </div>
    );
  }

  const sections = parseAnnexSections(annexText);

  return (
    <div>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          lineHeight: 1.8,
          color: '#334155',
          marginBottom: '18px',
          paddingBottom: '16px',
          borderBottom: '1px dashed #cbd5e1',
        }}
      >
        {mainText}
      </div>

      <div
        style={{
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          border: '2px solid #334155',
          borderRadius: '12px',
          padding: '18px',
        }}
      >
        <h3
          style={{
            margin: '0 0 16px',
            textAlign: 'center',
            color: '#0f172a',
            fontSize: '1.1rem',
          }}
        >
          {ANNEX_TITLE}
        </h3>

        {sections.map((section) => (
          <div key={section.title} style={sectionCardStyle}>
            <h4 style={sectionTitleStyle}>{section.title}</h4>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, color: '#334155' }}>
              {section.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContractTextViewer;
