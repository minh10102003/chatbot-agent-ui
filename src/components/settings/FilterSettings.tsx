// src/components/settings/FilterSettings.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, Save, RotateCcw } from "lucide-react";
import { useStreamContext } from "@/providers/Stream";
import { MessageFilter, ThreadTitleConfig, DEFAULT_MESSAGE_FILTER, DEFAULT_TITLE_CONFIG } from "@/types/message-filter";
import { toast } from "sonner";

export const FilterSettings: React.FC = () => {
  const { messageFilter, updateFilterConfig, updateTitleConfig } = useStreamContext();
  
  const [filterConfig, setFilterConfig] = useState<MessageFilter>(DEFAULT_MESSAGE_FILTER);
  const [titleConfig, setTitleConfig] = useState<ThreadTitleConfig>(DEFAULT_TITLE_CONFIG);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = () => {
    try {
      updateFilterConfig(filterConfig);
      updateTitleConfig(titleConfig);
      toast.success("Settings saved successfully");
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const handleReset = () => {
    setFilterConfig(DEFAULT_MESSAGE_FILTER);
    setTitleConfig(DEFAULT_TITLE_CONFIG);
    updateFilterConfig(DEFAULT_MESSAGE_FILTER);
    updateTitleConfig(DEFAULT_TITLE_CONFIG);
    toast.info("Settings reset to default");
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 h-10 w-10 rounded-full shadow-lg"
      >
        <Settings className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Message Filter & Title Settings
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Message Filter Settings */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Message Filtering</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minLength">Min Length</Label>
                <Input
                  id="minLength"
                  type="number"
                  value={filterConfig.minLength || 0}
                  onChange={(e) => setFilterConfig(prev => ({
                    ...prev,
                    minLength: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxLength">Max Length</Label>
                <Input
                  id="maxLength"
                  type="number"
                  value={filterConfig.maxLength || 4000}
                  onChange={(e) => setFilterConfig(prev => ({
                    ...prev,
                    maxLength: parseInt(e.target.value) || 4000
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="blockedKeywords">Blocked Keywords (comma separated)</Label>
              <Input
                id="blockedKeywords"
                value={filterConfig.blockedKeywords?.join(', ') || ''}
                onChange={(e) => setFilterConfig(prev => ({
                  ...prev,
                  blockedKeywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                }))}
                placeholder="word1, word2, word3"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sanitization">Enable Content Sanitization</Label>
              <Switch
                id="sanitization"
                checked={filterConfig.enableContentSanitization ?? true}
                onCheckedChange={(checked) => setFilterConfig(prev => ({
                  ...prev,
                  enableContentSanitization: checked
                }))}
              />
            </div>
          </div>

          <Separator />

          {/* Title Generation Settings */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Thread Title Generation</Label>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="titleEnabled">Enable Auto Title</Label>
              <Switch
                id="titleEnabled"
                checked={titleConfig.enabled}
                onCheckedChange={(checked) => setTitleConfig(prev => ({
                  ...prev,
                  enabled: checked
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="titleMaxLength">Title Max Length</Label>
              <Input
                id="titleMaxLength"
                type="number"
                value={titleConfig.maxLength}
                onChange={(e) => setTitleConfig(prev => ({
                  ...prev,
                  maxLength: parseInt(e.target.value) || 50
                }))}
                min={10}
                max={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fallbackTemplate">
                Fallback Template (use {"{{timestamp}}"} for timestamp)
              </Label>
              <Input
                id="fallbackTemplate"
                value={titleConfig.fallbackTemplate}
                onChange={(e) => setTitleConfig(prev => ({
                  ...prev,
                  fallbackTemplate: e.target.value
                }))}
                placeholder="Chat {{timestamp}}"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
            
            <Button onClick={handleReset} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            
            <Button onClick={() => setIsOpen(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};