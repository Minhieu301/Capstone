package com.C1SE61.backend.dto.request.ai;

import lombok.Data;

@Data
public class ChatRequestDTO {
    private Integer userId;     
    private String question;     
    private String conversationId;
    private boolean saveLog = true; 
}
