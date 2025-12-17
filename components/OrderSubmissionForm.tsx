'use client';

import { useState, useEffect } from 'react';
import GlassCard from './GlassCard';
import GlassButton from './GlassButton';
import { useAuth } from '@/contexts/AuthContext';

interface LineItem {
  itemName: string;
  description: string;
  qty: string;
  uom: string;
}

interface SchoolOption {
  recordId: string;
  schoolName: string;
}

interface UOMOption {
  recordId: string;
  uomValue: string;
}

export default function OrderSubmissionForm() {
  const { user } = useAuth();
  const [jobNumber, setJobNumber] = useState('');
  const [reqDate, setReqDate] = useState('');
  const [dateRequiredForDelivery, setDateRequiredForDelivery] = useState('');
  const [orderedBy, setOrderedBy] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { itemName: '', description: '', qty: '', uom: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [uomOptions, setUomOptions] = useState<UOMOption[]>([]);
  const [isLoadingUOM, setIsLoadingUOM] = useState(true);

  // Set default "Ordered By" to logged-in user's email
  useEffect(() => {
    if (user?.email && !orderedBy) {
      setOrderedBy(user.email);
    }
  }, [user, orderedBy]);

  // Fetch school names on component mount
  useEffect(() => {
    const fetchSchoolNames = async () => {
      try {
        setIsLoadingSchools(true);
        const response = await fetch('/api/get-school-names');
        const data = await response.json();
        
        if (response.ok && data.success) {
          setSchoolOptions(data.options || []);
        } else {
          console.error('Failed to fetch school names:', data);
          const errorMsg = data.error || 'Unknown error';
          const details = data.details ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}` : '';
          setSubmitStatus('error');
          setSubmitMessage(`Failed to load school options: ${errorMsg}${details}`);
        }
      } catch (error) {
        console.error('Error fetching school names:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        setSubmitStatus('error');
        setSubmitMessage(`Failed to load school options: ${errorMsg}\n\nPlease check the browser console and server logs for more details.`);
      } finally {
        setIsLoadingSchools(false);
      }
    };

    fetchSchoolNames();
  }, []);

  // Fetch UOM options on component mount
  useEffect(() => {
    const fetchUOMOptions = async () => {
      try {
        setIsLoadingUOM(true);
        const response = await fetch('/api/get-uom-options');
        const data = await response.json();
        
        if (response.ok && data.success) {
          setUomOptions(data.options || []);
        } else {
          console.error('Failed to fetch UOM options:', data);
          const errorMsg = data.error || 'Unknown error';
          const details = data.details ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}` : '';
          // Don't show error in form status, just log it
          console.warn(`Failed to load UOM options: ${errorMsg}${details}`);
        }
      } catch (error) {
        console.error('Error fetching UOM options:', error);
        // Don't show error in form status, just log it
        console.warn('Failed to load UOM options. Please check the browser console and server logs.');
      } finally {
        setIsLoadingUOM(false);
      }
    };

    fetchUOMOptions();
  }, []);

  const addLineItem = () => {
    setLineItems([...lineItems, { itemName: '', description: '', qty: '', uom: '' }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/submit-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobNumber,
          reqDate,
          dateRequiredForDelivery,
          orderedBy,
          lineItems,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitStatus('success');
        setSubmitMessage('Order submitted successfully!');
        // Reset form
        setJobNumber('');
        setReqDate('');
        setDateRequiredForDelivery('');
        setOrderedBy('');
        setLineItems([{ itemName: '', description: '', qty: '', uom: '' }]);
      } else {
        setSubmitStatus('error');
        const errorMsg = data.error || 'Failed to submit order';
        const details = data.details ? `\n\nDetails: ${JSON.stringify(data.details, null, 2)}` : '';
        setSubmitMessage(`${errorMsg}${details}`);
      }
    } catch (error) {
      setSubmitStatus('error');
      const errorMsg = error instanceof Error ? error.message : 'An error occurred while submitting the order';
      setSubmitMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <GlassCard className="space-y-6">
        <h2 className="text-2xl font-bold text-white mb-6">
          Order Submission
        </h2>

        {/* Main Order Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="jobNumber" className="block text-sm font-semibold mb-2 text-white">
              School Name *
            </label>
            {isLoadingSchools ? (
              <div className="glass-input-enhanced w-full px-4 py-3 rounded-xl text-[var(--glass-black-dark)] opacity-60">
                Loading schools...
              </div>
            ) : (
              <select
                id="jobNumber"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value)}
                required
                className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
              >
                <option value="">Select a school...</option>
                {schoolOptions.map((option) => (
                  <option key={option.recordId} value={option.recordId}>
                    {option.schoolName}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="orderedBy" className="block text-sm font-semibold mb-2 text-white">
              Ordered By (Email) *
            </label>
            <input
              type="email"
              id="orderedBy"
              value={orderedBy}
              onChange={(e) => setOrderedBy(e.target.value)}
              required
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label htmlFor="reqDate" className="block text-sm font-semibold mb-2 text-white">
              Req Date *
            </label>
            <input
              type="date"
              id="reqDate"
              value={reqDate}
              onChange={(e) => setReqDate(e.target.value)}
              required
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="dateRequiredForDelivery" className="block text-sm font-semibold mb-2 text-white">
              Date Required For Delivery *
            </label>
            <input
              type="date"
              id="dateRequiredForDelivery"
              value={dateRequiredForDelivery}
              onChange={(e) => setDateRequiredForDelivery(e.target.value)}
              required
              className="glass-input-enhanced w-full px-4 py-3 rounded-xl"
            />
          </div>
        </div>

        {/* Line Items Section */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">
              Order Line Items
            </h3>
            <GlassButton
              type="button"
              variant="outline"
              onClick={addLineItem}
              className="text-sm border-white/50 text-white hover:border-white hover:text-white"
            >
              + Add Line Item
            </GlassButton>
          </div>

          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <GlassCard key={index} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-semibold text-white">
                    Line Item {index + 1}
                  </h4>
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="text-red-500 hover:text-red-700 font-semibold px-3 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      value={item.itemName}
                      onChange={(e) => updateLineItem(index, 'itemName', e.target.value)}
                      required
                      className="glass-input-enhanced w-full px-4 py-2 rounded-xl"
                      placeholder="Enter item name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      required
                      className="glass-input-enhanced w-full px-4 py-2 rounded-xl"
                      placeholder="Enter description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      Qty *
                    </label>
                    <input
                      type="number"
                      value={item.qty}
                      onChange={(e) => updateLineItem(index, 'qty', e.target.value)}
                      required
                      min="0"
                      step="0.01"
                      className="glass-input-enhanced w-full px-4 py-2 rounded-xl"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-white">
                      UOM *
                    </label>
                    {isLoadingUOM ? (
                      <div className="glass-input-enhanced w-full px-4 py-2 rounded-xl text-[var(--glass-black-dark)] opacity-60">
                        Loading UOM options...
                      </div>
                    ) : (
                      <select
                        value={item.uom}
                        onChange={(e) => updateLineItem(index, 'uom', e.target.value)}
                        required
                        className="glass-input-enhanced w-full px-4 py-2 rounded-xl"
                      >
                        <option value="">Select UOM...</option>
                        {uomOptions.map((option) => (
                          <option key={option.recordId} value={option.recordId}>
                            {option.uomValue}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Submit Button and Status */}
        <div className="flex flex-col items-center gap-4 pt-6">
          {submitStatus && (
            <div
              className={`px-6 py-3 rounded-xl font-semibold whitespace-pre-wrap ${
                submitStatus === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {submitMessage}
            </div>
          )}

          <GlassButton
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="min-w-[200px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Order'}
          </GlassButton>
        </div>
      </GlassCard>
    </form>
  );
}

