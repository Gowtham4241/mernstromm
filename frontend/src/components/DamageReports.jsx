// DamageReports.js
import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, Clock, Upload, Trash2, Video, XCircle } from 'lucide-react';

export default function DamageReports({ token, vehicles, reports, onRefresh, onNavigate }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [error, setError] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  const [imgMode, setImgMode] = useState('upload');
  const [webcamActive, setWebcamActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const startWebcam = async () => {
    setCameraError('');
    setWebcamActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Error starting camera:', err);
      setCameraError('Permission denied or camera in use. Please select file upload instead.');
      setWebcamActive(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setWebcamActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImageUrl(dataUrl);
        stopWebcam();
      }
    } catch (err) {
      setCameraError('Failed to capture frame from video: ' + err.message);
    }
  };

  const [latestReport, setLatestReport] = useState(null);

  const handleScanReport = async (e) => {
    e.preventDefault();
    setError('');
    setValidationResult(null);
    setScanning(true);

    if (!vehicleId) {
      setError('Please select a garaged vehicle for this ticket.');
      setScanning(false);
      return;
    }
    if (!description.trim()) {
      setError('Please fill in a description of the damage or incident details.');
      setScanning(false);
      return;
    }
    if (!imageUrl) {
      setError('Please upload or capture a clear vehicle damage image.');
      setScanning(false);
      return;
    }

    const messages = [
      'Configuring server connection...',
      'Downloading appraisal images...',
      'Analyzing damage description & model vectors...',
      'Initiating multimodal Gemini-3.5-Flash scan...',
      'Identifying chassis parts & repair components...',
      'Calculating local labor rates & material costs...',
      'Synthesizing mechanical diagnostic assessment...'
    ];

    let currentMsg = 0;
    setScanMessage(messages[0]);
    const timer = setInterval(() => {
      currentMsg = (currentMsg + 1) % messages.length;
      setScanMessage(messages[currentMsg]);
    }, 1800);

    try {
      const res = await fetch('/api/damage-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleId,
          description,
          imageUrl: imageUrl || undefined
        })
      });

      const data = await res.json();
      if (!res.ok && data.validation) {
        setValidationResult(data.validation);
        setLatestReport(null);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'AI analysis timed out or failed.');
      }

      setLatestReport(data);
      setValidationResult(data.aiDiagnosis || null);
      setDescription('');
      setImageUrl('');
      onRefresh();
    } catch (err) {
      setError(err.message || 'AI diagnosis failed. Please check internet connections or secret keys.');
    } finally {
      clearInterval(timer);
      setScanning(false);
    }
  };

  const getVehicleName = (id) => {
    const v = vehicles.find(item => item.id === id);
    return v ? `${v.vehicleType || 'Vehicle'} - ${v.make} ${v.model} (${v.year})` : 'Unknown Vehicle';
  };

  useEffect(() => {
    if (!vehicleId && vehicles.length > 0) {
      setVehicleId(vehicles[0].id);
    }
  }, [vehicleId, vehicles]);

  const isPendingReview = validationResult?.aiStatus === 'PENDING_REVIEW';
  const claimStatus = validationResult?.claimStatus || validationResult?.approvalStatus;
  const isApproved = claimStatus === 'APPROVED';
  const vehicleMatch = validationResult?.vehicleMatch ?? validationResult?.vehicleMatches;
  const damageMatch = validationResult?.damageMatch ?? validationResult?.descriptionMatches;
  const aiReason = validationResult?.reason || validationResult?.rejectionReason || validationResult?.urgencyReasoning;

  return (
    <div className="space-y-6" id="damage-reports-app">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-black text-white tracking-tight">AI Damage Appraisal</h1>
        <p className="text-sm text-slate-400">
          Upload photo specs or describe issues to receive near-instant diagnostics report powered by Google Gemini AI.
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center rounded-2xl flex flex-col items-center justify-center max-w-xl mx-auto space-y-4">
          <div className="p-3 bg-red-950/30 rounded-full border border-red-500/20 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-200 font-sans">No Vehicles Found</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              You must register a vehicle in your Garage before seeking AI appraisals.
            </p>
          </div>
          <button
            onClick={() => onNavigate('garage')}
            className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 px-4 rounded-lg transition"
          >
            Go to Garage
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <h2 className="text-base font-bold text-white mb-4">New Damage Appraisal</h2>

              {error && (
                <div className="bg-red-950/20 border border-red-500/30 text-red-400 p-3 rounded-lg text-xs mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleScanReport} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Select Vehicle</label>
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm cursor-pointer"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.vehicleType || 'Vehicle'} - {v.make} {v.model} ({v.year}) - {v.licensePlate}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">Damage / Incident Description</label>
                  <textarea
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what occurred, any visible markings, leaks, warning indicators, or squeaking noises..."
                    className="w-full bg-slate-950 hover:bg-slate-950/80 border border-slate-800 focus:border-red-500 text-slate-200 py-2 px-3 rounded-lg outline-none text-sm transition"
                  ></textarea>
                </div>

                <div id="image-acquisition-hub">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">Damage Photo / Asset Visual</label>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3" id="upload-webcam-selector">
                    <button
                      type="button"
                      id="upload-mode-btn"
                      onClick={() => {
                        stopWebcam();
                        setImgMode('upload');
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        imgMode === 'upload'
                          ? 'bg-slate-800 text-white border-red-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Upload className="w-4 h-4" />
                      Upload Photo
                    </button>
                    <button
                      type="button"
                      id="webcam-mode-btn"
                      onClick={() => {
                        setImgMode('webcam');
                        startWebcam();
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                        imgMode === 'webcam'
                          ? 'bg-slate-800 text-white border-red-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <Camera className="w-4 h-4" />
                      Live Webcam
                    </button>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3">
                    {imgMode === 'upload' && (
                      <div className="space-y-3" id="file-dropzone">
                        <div className="border border-dashed border-slate-800 hover:border-slate-700 rounded-lg p-4 text-center cursor-pointer relative group transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <Upload className="w-6 h-6 mx-auto mb-2 text-slate-500 group-hover:text-slate-300 transition" />
                          <p className="text-xs font-semibold text-slate-300">Click or Drag & Drop File</p>
                          <p className="text-[10px] text-slate-500 mt-1">Supports PNG, JPG, WEBP, HEIC</p>
                        </div>
                        
                        <div>
                          <input
                            type="url"
                            value={imageUrl.startsWith('data:') ? '' : imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="Or paste an image web link here..."
                            className="w-full bg-slate-900 border border-slate-800 focus:border-red-500 text-slate-300 py-1.5 px-2.5 rounded-lg outline-none text-xs transition"
                          />
                        </div>
                      </div>
                    )}

                    {imgMode === 'webcam' && (
                      <div className="space-y-3 text-center" id="webcam-viewer">
                        {cameraError && (
                          <div className="bg-red-950/20 border border-red-500/20 text-red-400 p-2.5 rounded text-[11px]">
                            {cameraError}
                          </div>
                        )}

                        {webcamActive ? (
                          <div className="space-y-3">
                            <div className="relative overflow-hidden rounded-lg bg-black aspect-video max-w-sm mx-auto border border-slate-800">
                              <video
                                ref={videoRef}
                                playsInline
                                muted
                                className="w-full h-full object-cover transform -scale-x-100"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-650 text-[9px] uppercase font-black tracking-widest text-white flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                Live Feed
                              </div>
                            </div>
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={capturePhoto}
                                className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition select-none"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                Capture Frame
                              </button>
                              <button
                                type="button"
                                onClick={stopWebcam}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition select-none"
                              >
                                Stop Camera
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-6 flex flex-col items-center justify-center space-y-3">
                            <Video className="w-8 h-8 text-slate-500" />
                            <div>
                              <p className="text-xs text-slate-400 font-semibold">Webcam is currently disabled</p>
                              <p className="text-[10px] text-slate-500">Access to your camera will be requested</p>
                            </div>
                            <button
                              type="button"
                              onClick={startWebcam}
                              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs py-1.5 px-4 rounded-lg cursor-pointer transition"
                            >
                              Activate Webcam
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {imageUrl && (
                    <div className="mt-3 bg-slate-950 border border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between gap-3 animate-fade-in" id="image-preview-thumbnail">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img
                          referrerPolicy="no-referrer"
                          src={imageUrl}
                          alt="Appraisal Snapshot Preview"
                          className="w-10 h-10 object-cover rounded-lg border border-slate-800 flex-shrink-0"
                        />
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Preview Loaded</span>
                          <span className="text-[10px] text-slate-500 block truncate max-w-[200px]">
                            {imageUrl.startsWith('data:') ? 'Captured/Uploaded Visual File' : imageUrl}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-slate-900 rounded-lg transition shrink-0 cursor-pointer"
                        title="Delete selected media attachment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                </div>

                <button
                  type="submit"
                  disabled={scanning}
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm py-2 px-4 rounded-lg shadow-lg hover:shadow-red-500/10 cursor-pointer disabled:opacity-50 transition"
                >
                  {scanning ? 'Analyzing Issue...' : 'Initiate AI Diagnostics Scan'}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-12 xl:col-span-7 space-y-6">
            {scanning && (
              <div className="bg-slate-900 border border-red-500/20 p-8 rounded-2xl flex flex-col items-center justify-center text-center space-y-4" id="scanning-hud">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-red-600"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs text-red-500 font-black">AI</div>
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">SCANNING VEHICLE COMPLIANCE</h3>
                  <p className="text-xs text-red-400 font-mono tracking-wider uppercase mt-1 animate-pulse">{scanMessage}</p>
                </div>
                <p className="text-slate-500 text-[10px] max-w-sm">
                  Google Gemini AI is verifying vehicle presence, visible damage, selected vehicle match, description match, fraud risk, and confidence thresholds. Please hold.
                </p>
              </div>
            )}

            {validationResult && (
              <div
                className={`border p-5 rounded-2xl shadow-sm ${
                  isApproved
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : isPendingReview
                      ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-red-950/20 border-red-500/30'
                }`}
                id="claim-validation-result"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl ${
                      isApproved
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : isPendingReview
                          ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isPendingReview ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-3 flex-1">
                    <div>
                      <h2
                        className={`text-sm font-black uppercase tracking-wider ${
                          isApproved ? 'text-emerald-300' : isPendingReview ? 'text-amber-200' : 'text-red-300'
                        }`}
                      >
                        {isApproved ? 'Claim Approved' : isPendingReview ? 'Claim Submitted - Manual Review' : 'Claim Rejected'}
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        {isApproved
                          ? 'Strict AI validation passed. This claim can proceed.'
                          : isPendingReview
                            ? validationResult.userMessage || 'AI analysis is temporarily unavailable. Your claim has been submitted and will be reviewed manually.'
                          : aiReason || 'Claim validation rejected.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                        <span className="text-[9px] text-slate-500 uppercase font-bold block">Vehicle Match</span>
                        <span className={`text-[11px] font-black ${isPendingReview ? 'text-amber-300' : vehicleMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPendingReview ? 'Pending' : vehicleMatch ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                        <span className="text-[9px] text-slate-500 uppercase font-bold block">Damage Match</span>
                        <span className={`text-[11px] font-black ${isPendingReview ? 'text-amber-300' : damageMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPendingReview ? 'Pending' : damageMatch ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                        <span className="text-[9px] text-slate-500 uppercase font-bold block">Confidence</span>
                        <span className={`text-[11px] font-black ${isPendingReview ? 'text-amber-300' : Number(validationResult.confidence) >= 80 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPendingReview ? 'Manual' : `${Number(validationResult.confidence || 0)}%`}
                        </span>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                        <span className="text-[9px] text-slate-500 uppercase font-bold block">Fraud Risk</span>
                        <span
                          className={`text-[11px] font-black ${
                            validationResult.fraudRisk === 'LOW'
                              ? 'text-emerald-400'
                              : validationResult.fraudRisk === 'MEDIUM'
                                ? 'text-amber-300'
                                : 'text-red-400'
                          }`}
                        >
                          {validationResult.fraudRisk || 'HIGH'}
                        </span>
                      </div>
                      <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2">
                        <span className="text-[9px] text-slate-500 uppercase font-bold block">Claim Status</span>
                        <span className={`text-[11px] font-black ${isApproved ? 'text-emerald-400' : isPendingReview ? 'text-amber-300' : 'text-red-400'}`}>
                          {claimStatus || 'REJECTED'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2">
                        Vehicle Detected: <strong className={isPendingReview ? 'text-amber-300' : validationResult.vehicleDetected ? 'text-emerald-400' : 'text-red-400'}>{isPendingReview ? 'Pending' : validationResult.vehicleDetected ? validationResult.vehicleType || 'Detected' : 'Missing'}</strong>
                      </div>
                      <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2">
                        Damage Detected: <strong className={isPendingReview ? 'text-amber-300' : validationResult.damageDetected ? 'text-emerald-400' : 'text-red-400'}>{isPendingReview ? 'Pending' : validationResult.damageDetected ? validationResult.damageType || 'Detected' : 'Missing'}</strong>
                      </div>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-[11px] text-slate-400">
                      <span className="text-[9px] text-slate-500 uppercase font-bold block mb-1">AI Reasoning</span>
                      {aiReason || 'No reasoning returned.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {latestReport ? (
              <div className="space-y-4" id="appraisal-result">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-200 uppercase tracking-wider">Latest Appraisal Report</h2>
                  <button
                    onClick={() => {
                      setLatestReport(null);
                      setValidationResult(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 font-bold transition flex items-center gap-1 bg-slate-900 border border-slate-800 py-1 px-2.5 rounded-lg cursor-pointer"
                  >
                    Clear Result
                  </button>
                </div>
                
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 relative overflow-hidden shadow-sm">
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${
                    latestReport.severity === 'low' ? 'bg-emerald-500' : latestReport.severity === 'medium' ? 'bg-orange-500' : 'bg-red-500'
                  }`}></div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3 pl-2.5">
                    <div>
                      <div className="font-extrabold text-sm text-slate-200">{getVehicleName(latestReport.vehicleId)}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${
                          latestReport.severity === 'low' 
                            ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-400' 
                            : latestReport.severity === 'medium' 
                              ? 'bg-orange-950/40 border border-orange-500/20 text-orange-400' 
                              : 'bg-red-950/40 border border-red-500/20 text-red-400'
                        }`}>
                          Severity: {latestReport.severity}
                        </span>
                          <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800`}>
                          STATUS: {latestReport.status.replace('_', ' ')}
                        </span>
                        <span className={`text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full ${
                          latestReport.fraudRisk === 'LOW'
                            ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-400'
                            : latestReport.fraudRisk === 'MEDIUM'
                              ? 'bg-amber-950/40 border border-amber-500/20 text-amber-300'
                              : 'bg-red-950/40 border border-red-500/20 text-red-400'
                        }`}>
                          Fraud Risk: {latestReport.fraudRisk || latestReport.aiDiagnosis?.fraudRisk || 'LOW'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">{new Date(latestReport.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pl-2.5">
                    {latestReport.imageUrl && (
                      <img referrerPolicy="no-referrer" src={latestReport.imageUrl} alt="Accident visual" className="w-full sm:w-32 h-24 object-cover rounded-xl border border-slate-800 flex-shrink-0" />
                    )}
                    <div className="space-y-1.5 flex-1">
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 block">User statement</span>
                      <p className="text-xs text-slate-300 italic">"{latestReport.description}"</p>
                    </div>
                  </div>

                  {latestReport.aiDiagnosis && (
                    <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-4 pl-2.5" id="ai-specifications-sheet">
                      <div className="flex items-center gap-1.5 text-red-400 text-xs font-black">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.43c.89-.443 1.1-1.632.414-2.268L12 9.3M3 21l9-9m3-6l2.25 2.25M6.225 15.775L4.5 18l2.25-1.725m10.5-12l3 3M19.5 4.5h.008v.008h-.008V4.5z" />
                        </svg>
                        <span>AUTOAID NEURAL ESTIMATES REPORT</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Mechanical Classifications</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(latestReport.aiDiagnosis.classifications || []).map((c, i) => (
                              <span key={i} className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">{c}</span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 block">Replacements Parts List</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(latestReport.aiDiagnosis.partsNeeded || []).map((p, i) => (
                              <span key={i} className="bg-slate-900 border border-slate-800 text-red-300 px-2 py-0.5 rounded text-[10px] font-mono">{p}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-slate-900 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-bold">Parts Cost</span>
                          <span className="text-xs font-bold text-white font-mono mt-0.5">{latestReport.aiDiagnosis.costEstimation.partsCostRange}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-bold">Labor Cost</span>
                          <span className="text-xs font-bold text-white font-mono mt-0.5">{latestReport.aiDiagnosis.costEstimation.laborCostRange}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-bold">Total Estimate</span>
                          <span className="text-xs font-black text-rose-500 font-mono mt-0.5">{latestReport.aiDiagnosis.costEstimation.totalEstimatedRange}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block uppercase font-bold">Appraiser Trust</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono mt-0.5">{Math.round(latestReport.aiDiagnosis.costEstimation.confidenceScore * 100)}% Match</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        <span className="text-[9px] text-slate-500 block uppercase font-bold">Urgency Reasoning & Diagnostic Guideline</span>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{latestReport.aiDiagnosis.urgencyReasoning}</p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-slate-900 gap-2">
                        <div className="text-[10px] text-slate-500">
                          Estimated Repair Time Required: <strong className="text-slate-300 font-mono">{latestReport.aiDiagnosis.estimatedRepairTime}</strong>
                        </div>
                        <button
                          onClick={() => onNavigate('mechanics')}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider flex items-center gap-1.5 justify-end"
                        >
                          Search Mechanics for Repairs &rarr;
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              !scanning && !validationResult && (
                <div className="border border-dashed border-slate-800 bg-slate-900/10 p-12 text-center rounded-2xl flex flex-col items-center justify-center space-y-4 h-full min-h-[300px]">
                  <div className="p-3 bg-red-950/20 rounded-full border border-red-500/10 text-red-500/60">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.904-4.43c.89-.443 1.1-1.632.414-2.268L12 9.3M3 21l9-9m3-6l2.25 2.25M6.225 15.775L4.5 18l2.25-1.725m10.5-12l3 3M19.5 4.5h.008v.008h-.008V4.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-300 font-sans">Appraisal Standby</h3>
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm">
                      Submit a new description and attach photo visual assets using the camera or upload system to initiate deep cognitive neural diagnostics.
                    </p>
                  </div>
                </div>
              )
            )}

          </div>

        </div>
      )}
    </div>
  );
}
